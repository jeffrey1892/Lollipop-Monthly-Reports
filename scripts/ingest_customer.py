#!/usr/bin/env python3
"""Ingest one single-account customer's Lollipop exports (everyone except
Zipdev, which has two accounts — use scripts/ingest_zipdev.py for it).

  /usr/bin/python3 scripts/ingest_customer.py --customer goodman-realty \
      --responses ~/Downloads/responses-goodman realty--....xlsx \
      --roster    ~/Downloads/company_employees-goodman.csv \
      --effective-from 2026-09 --through 2026-09

Behavior:
  - Every month found in the responses export (up to --through) is REPLACED,
    deduped on person+timestamp+content, ids regenerated
    <customer>-<YYYY-MM>-<n>. Other months are left untouched, so
    re-uploading a cumulative export is always safe.
  - A roster, when provided, becomes a rosterVersions entry effective
    --effective-from (replacing any entry with the same month); earlier
    months keep their historical denominator. Top-level roster is set to the
    latest version.
"""
import argparse, json, sys
from datetime import datetime

from ingest_zipdev import DATA, month_key, parse_responses, parse_roster

FIELDS = ['id', 'firstName', 'lastName', 'team', 'date', 'mood',
          'emotions', 'followUpRequested', 'followUpStatus', 'comments']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--customer', required=True)
    ap.add_argument('--responses')
    ap.add_argument('--roster')
    ap.add_argument('--data', default=str(DATA))
    ap.add_argument('--effective-from', default=datetime.now().strftime('%Y-%m'),
                    help='month (YYYY-MM) the new roster takes effect')
    ap.add_argument('--through', help='ignore responses after this month (YYYY-MM), '
                                      'e.g. to drop a partial current month')
    args = ap.parse_args()
    if not (args.responses or args.roster):
        ap.error('nothing to ingest — pass --responses and/or --roster')

    data = json.load(open(args.data))
    cust = next((c for c in data['customers'] if c['id'] == args.customer), None)
    if cust is None:
        sys.exit(f'customer {args.customer} not found in {args.data}')

    if args.roster:
        roster = parse_roster(args.roster)
        versions = cust.get('rosterVersions') or [dict(effectiveFrom='0000-00', roster=cust.get('roster', []))]
        versions = [v for v in versions if v['effectiveFrom'] != args.effective_from]
        versions.append(dict(effectiveFrom=args.effective_from, roster=roster))
        versions.sort(key=lambda v: v['effectiveFrom'])
        cust['rosterVersions'] = versions
        cust['roster'] = versions[-1]['roster']
        print(f'roster: {len(roster)} employees, effective {args.effective_from} · '
              f'versions {[(v["effectiveFrom"], len(v["roster"])) for v in versions]}')

    if args.responses:
        by_month = {}
        for rec in parse_responses(args.responses):
            mk, d = month_key(rec)
            if args.through and mk > args.through:
                continue
            by_month.setdefault(mk, []).append((d, rec))
        for mk in sorted(by_month):
            before = next((len(m['responses']) for m in cust['months'] if m['month'] == mk), 0)
            dedup, seen = [], set()
            for _, rec in sorted(by_month[mk], key=lambda x: x[0]):
                key = (rec['firstName'].lower(), rec['lastName'].lower(), rec['date'],
                       rec['mood'], tuple(rec['emotions']), rec['comments'])
                if key in seen:
                    continue
                seen.add(key)
                dedup.append(rec)
            for i, rec in enumerate(dedup, 1):
                rec['id'] = f'{args.customer}-{mk}-{i}'
            label = datetime.strptime(mk, '%Y-%m').strftime('%b %Y')
            cust['months'] = [m for m in cust['months'] if m['month'] != mk]
            cust['months'].append(dict(month=mk, label=label,
                                       responses=[{k: r[k] for k in FIELDS} for r in dedup]))
            if before != len(dedup):
                print(f'{mk}: {before} -> {len(dedup)} responses')
        cust['months'].sort(key=lambda m: m['month'])

    json.dump(data, open(args.data, 'w'), indent=1)
    print('written:', args.data)


if __name__ == '__main__':
    main()
