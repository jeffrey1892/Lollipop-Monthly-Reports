#!/usr/bin/env python3
"""Consolidate the Zipdev main + Zipdev dev2 Lollipop accounts into the single
`zipdev` reporting customer.

Zipdev runs two Lollipop accounts on different delivery schedules, but the
dashboard reports them as ONE customer:
  - roster (the engagement denominator) = main roster + dev2 roster
  - responses = main responses + dev2 responses
  - every dev2 response is forced onto one team: "Internal Team"
    (whatever team value the dev2 export carries is overridden)

Run it after each monthly export, passing whichever files were uploaded:

  /usr/bin/python3 scripts/ingest_zipdev.py \
      --main-responses  ~/Downloads/responses-zipdev-....xlsx \
      --dev2-responses  ~/Downloads/responses-zipdev-dev2-....xlsx \
      --main-roster     ~/Downloads/company_employees-main.csv \
      --dev2-roster     ~/Downloads/company_employees-dev2.csv

Behavior:
  - Months found in the response files are REPLACED in the zipdev customer
    (main+dev2 merged, deduped on person+timestamp+content); other months
    are left untouched.
  - Rosters, when provided, replace their half of the combined roster: dev2
    entries are tagged "source": "zipdev-dev2" so the next upload can swap
    them out without touching the main roster (and vice versa).
  - Omit a flag to keep that piece as-is (e.g. rosters rarely change).
"""
import argparse, csv, json, sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / 'src' / 'data' / 'demoData.json'
CUSTOMER_ID = 'zipdev'
DEV2_TEAM = 'Internal Team'
DEV2_SOURCE = 'zipdev-dev2'


def parse_responses(path, force_team=None):
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    out = []
    for r in rows[1:]:
        if r is None or len(r) < 6 or r[1] is None:
            continue
        first = str(r[1]).strip()
        last = str(r[2] or '').strip()
        team = force_team if force_team else str(r[3] or '').strip()
        date = ' '.join(str(r[4] or '').strip().split())
        mood = float(r[5]) if r[5] is not None else None
        emotions = [e.strip() for e in str(r[6] or '').split(',') if e.strip()] if len(r) > 6 else []
        fu = str(r[7] or '').strip().lower() == 'yes' if len(r) > 7 else False
        fus = str(r[8] or '').strip() if len(r) > 8 else ''
        com = str(r[9] or '').strip() if len(r) > 9 else ''
        out.append(dict(firstName=first, lastName=last, team=team, date=date, mood=mood,
                        emotions=emotions, followUpRequested=fu, followUpStatus=fus, comments=com))
    return out


def parse_roster(path, source=None):
    out = []
    with open(path, newline='', encoding='utf-8-sig') as fh:
        for row in csv.DictReader(fh):
            fn = (row.get('First Name') or '').strip()
            ln = (row.get('Last Name') or '').strip()
            if not fn and not ln:
                continue
            e = dict(id=str(row.get('ID') or '').strip(), firstName=fn, lastName=ln)
            email = (row.get('Email') or '').strip().strip('"')
            if email:
                e['email'] = email
            if source:
                e['source'] = source
            out.append(e)
    return out


def month_key(rec):
    d = datetime.strptime(' '.join(rec['date'].split()), '%b %d, %Y %I:%M %p')
    return d.strftime('%Y-%m'), d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--main-responses')
    ap.add_argument('--dev2-responses')
    ap.add_argument('--main-roster')
    ap.add_argument('--dev2-roster')
    ap.add_argument('--data', default=str(DATA))
    args = ap.parse_args()
    if not any([args.main_responses, args.dev2_responses, args.main_roster, args.dev2_roster]):
        ap.error('nothing to ingest — pass at least one file')

    data = json.load(open(args.data))
    cust = next((c for c in data['customers'] if c['id'] == CUSTOMER_ID), None)
    if cust is None:
        sys.exit(f'customer {CUSTOMER_ID} not found in {args.data}')

    # --- Roster halves -----------------------------------------------------
    existing = cust.get('roster', [])
    main_half = [e for e in existing if e.get('source') != DEV2_SOURCE]
    dev2_half = [e for e in existing if e.get('source') == DEV2_SOURCE]
    if args.main_roster:
        main_half = parse_roster(args.main_roster)
        print(f'main roster replaced: {len(main_half)} employees')
    if args.dev2_roster:
        dev2_half = parse_roster(args.dev2_roster, source=DEV2_SOURCE)
        print(f'dev2 roster replaced: {len(dev2_half)} employees')
    # Combined denominator; dedupe by name in case someone appears in both
    seen_names = set()
    roster = []
    for e in main_half + dev2_half:
        k = (e['firstName'].strip().lower(), e['lastName'].strip().lower())
        if k in seen_names:
            continue
        seen_names.add(k)
        roster.append(e)
    cust['roster'] = roster
    print(f'combined roster: {len(roster)} employees '
          f'({len(main_half)} main + {len(dev2_half)} dev2, deduped)')

    # --- Responses ---------------------------------------------------------
    # Each account's upload replaces only ITS half of a month, so the two
    # spreadsheets can be ingested together or in separate runs without one
    # wiping the other. The halves are distinguishable because every dev2
    # response carries the forced team name.
    def bucket(recs):
        out = {}
        for rec in recs:
            mk, d = month_key(rec)
            out.setdefault(mk, []).append((d, rec))
        return out

    new_main = bucket(parse_responses(args.main_responses)) if args.main_responses else None
    new_dev2 = bucket(parse_responses(args.dev2_responses, force_team=DEV2_TEAM)) if args.dev2_responses else None
    if new_main is not None:
        print(f'main responses: {sum(len(v) for v in new_main.values())}')
    if new_dev2 is not None:
        print(f'dev2 responses: {sum(len(v) for v in new_dev2.values())} (team forced to "{DEV2_TEAM}")')

    touched = sorted(set(list((new_main or {}).keys()) + list((new_dev2 or {}).keys())))
    for mk in touched:
        existing_month = next((m for m in cust['months'] if m['month'] == mk), None)
        existing_recs = existing_month['responses'] if existing_month else []
        kept_main = [r for r in existing_recs if r.get('team') != DEV2_TEAM]
        kept_dev2 = [r for r in existing_recs if r.get('team') == DEV2_TEAM]

        if new_main is not None and mk in new_main:
            main_part = [rec for _, rec in new_main[mk]]
            print(f'{mk}: main half replaced ({len(kept_main)} -> {len(main_part)})')
        else:
            main_part = kept_main
        if new_dev2 is not None and mk in new_dev2:
            dev2_part = [rec for _, rec in new_dev2[mk]]
            print(f'{mk}: dev2 half replaced ({len(kept_dev2)} -> {len(dev2_part)})')
        else:
            dev2_part = kept_dev2

        def sort_key(rec):
            return datetime.strptime(' '.join(rec['date'].split()), '%b %d, %Y %I:%M %p')

        dedup, seen = [], set()
        for rec in sorted(main_part + dev2_part, key=sort_key):
            key = (rec['firstName'].lower(), rec['lastName'].lower(), rec['date'],
                   rec['mood'], tuple(rec['emotions']), rec['comments'])
            if key in seen:
                continue
            seen.add(key)
            dedup.append(rec)
        for i, rec in enumerate(dedup, 1):
            rec['id'] = f'{CUSTOMER_ID}-{mk}-{i}'
        ordered = [{k: r[k] for k in ['id', 'firstName', 'lastName', 'team', 'date', 'mood',
                                      'emotions', 'followUpRequested', 'followUpStatus', 'comments']}
                   for r in dedup]
        label = datetime.strptime(mk, '%Y-%m').strftime('%b %Y')
        cust['months'] = [m for m in cust['months'] if m['month'] != mk]
        cust['months'].append(dict(month=mk, label=label, responses=ordered))
        teams = sorted({r['team'] for r in dedup})
        print(f'{mk} ({label}): {len(dedup)} total responses · teams: {teams}')
    cust['months'].sort(key=lambda m: m['month'])

    json.dump(data, open(args.data, 'w'), indent=1)
    print('written:', args.data)


if __name__ == '__main__':
    main()
