#!/usr/bin/env python3
"""Restore/check authored skill tracks against the Client binary files.

Does not estimate keys from a recording or recolor/scale the authored tracks.
The binary layout and time semantics are documented in sources' LegacyEffFormat.h
and LegacyParticleCurves.h (also CMPModelEff::FrameMove in the DX9 sources).
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tool'))
from criar_efeitos import decode_eff, decode_par

REVISION = 'client-original-keyframes-v1'
PAR_FIELDS = ('life', 'delay', 'play', 'step', 'sizes', 'angles', 'colors', 'offset')


def collect_files(visual):
    files = [f for f in visual.get('files', []) if f]
    if visual.get('result'):
        files.append(visual['result'])
    for model in visual.get('models', []):
        files.extend(collect_files(model))
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('client', type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    manifest_path = ROOT / 'assets/skills/visuals.json'
    manifest = json.loads(manifest_path.read_text())
    catalog = json.loads((ROOT / 'assets/skills/catalog.json').read_text())
    index = {p.name.lower(): p for p in (args.client / 'effect').rglob('*') if p.is_file()}
    changed, sources, errors = [], {}, []
    for name, resource in manifest['resources'].items():
        if resource.get('kind') not in ('eff', 'par'):
            continue
        # Preview strip copies still refer to the original .par binary.
        original = re.sub(r'__s\d+(?:_\d+)?(?=\.)', '', name)
        path = index.get(original.lower())
        if not path:
            errors.append(f'{name}: original binary missing')
            continue
        raw = path.read_bytes()
        decoded = (decode_eff if resource['kind'] == 'eff' else decode_par)(raw)
        sources[name] = {'file': 'effect/' + original,
                         'sha256': hashlib.sha256(raw).hexdigest()}
        if resource['kind'] == 'eff':
            if len(resource['parts']) != len(decoded['parts']):
                errors.append(f'{name}: part count differs')
                continue
            for i, part in enumerate(decoded['parts']):
                target = resource['parts'][i]
                if target.get('keys') != part['keys']:
                    changed.append(f'{name}:parts:{i}:keys')
                    if args.write:
                        target['keys'] = part['keys']
        else:
            if len(resource['systems']) != len(decoded['systems']):
                errors.append(f'{name}: system count differs')
                continue
            for i, system in enumerate(decoded['systems']):
                for field in PAR_FIELDS:
                    if resource['systems'][i].get(field) != system.get(field):
                        changed.append(f'{name}:systems:{i}:{field}')
                        if args.write:
                            resource['systems'][i][field] = system[field]
            if resource.get('length') != decoded['length']:
                changed.append(f'{name}:length')
                if args.write:
                    resource['length'] = decoded['length']

    if errors:
        raise SystemExit('\n'.join(errors))

    def dependencies(files):
        found = set()
        pending = list(files)
        while pending:
            file = pending.pop()
            if not file or file in found or file not in manifest['resources']:
                continue
            found.add(file)
            for system in manifest['resources'][file].get('systems', []):
                pending.extend([system.get('effect'), system.get('hitEffect')])
        return sorted(found)

    skills = []
    for job, group in catalog['classes'].items():
        for skill in group['skills']:
            files = [file for ch in manifest['skills'][str(skill['id'])]['channels']
                     for visual in ch.get('visual', []) for file in collect_files(visual)]
            refs = dependencies(files)
            effs = [f for f in refs if manifest['resources'][f]['kind'] == 'eff']
            skills.append({'class': job, 'id': skill['id'], 'name': skill['name'],
                           'resources': refs,
                           'effParts': sum(len(manifest['resources'][f]['parts']) for f in effs),
                           'effKeyframes': sum(len(p['keys']) for f in effs
                                               for p in manifest['resources'][f]['parts'])})
    report = {'revision': REVISION, 'verified': not changed or args.write,
              'fields': {'d': 'duration of this key in seconds (not absolute time)',
                         's': 'XYZ scale', 'a': 'XYZ radians; editor displays degrees',
                         'p': 'XYZ metres, D3D axes: Z up', 'c': 'RGBA float32'},
              'interpolation': 'current -> next, including last -> first; PAR life / key count',
              'resources': sources, 'skills': skills,
              'effKeyframes': sum(len(p['keys']) for r in manifest['resources'].values()
                                  for p in r.get('parts', [])),
              'resourceCount': len(sources)}
    if args.write:
        manifest['keyframeSource'] = {'revision': REVISION,
                                     'files': 'Client/effect/*.eff and *.par',
                                     'semantics': 'sources/Engine/include/top/LegacyEffFormat.h; LegacyParticleCurves.h'}
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
        (ROOT / 'assets/skills/keyframes-audit.json').write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        # No authored key is a local edit. In particular remove the guessed
        # palettes, offsets, rotations and time clamps from the previous preset.
        (ROOT / 'assets/skills/vfx-edits.json').write_text(json.dumps(
            {'version': 2, 'res': {}, 'skills': {}, 'clones': {},
             'baseline': REVISION}, indent=2) + '\n')
    print(json.dumps({'mode': 'restore' if args.write else 'check',
                      'resources': len(sources), 'skillSlots': len(skills),
                      'effKeyframes': report['effKeyframes'], 'differentTracks': len(changed)}))
    if changed and not args.write:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
