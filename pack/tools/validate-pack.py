from pathlib import Path
import json, hashlib

root=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((root/p).read_text())
species=read('data/species.json');items=read('data/items.json');manifest=read('data/asset-manifest.json')
assert len(species)==20 and len({s['id'] for s in species})==20
assert len(items)==300 and len({i['id'] for i in items})==300
for s in species:
    p=Path(s['art']['concept_path']).parent
    assert read(p/'species.json')==s
    own=read(p/'items.json')
    assert len(own)==15
    assert own==[i for i in items if i['species_id']==s['id']]
    assert s['life_cycle']['offspring_per_event']==1
    assert s['life_cycle']['breeding_default'] is False
    assert s['economy']['adult_base_sale_price_coins']<s['economy']['adult_buy_price_coins']
    for f in ['ANIMAL-BRIEF.md','HABITAT-BRIEF.md','ANIMATION-BRIEF.md','concept-animal-habitat.png']:
        assert (root/p/f).is_file(),str(p/f)
    assert (root/s['art']['baby_reference_path']).is_file()
for entry in manifest['concepts']+manifest['shared']:
    assert (root/entry['path']).is_file()
hashpath=root/'data/artwork-checksums.json'
if hashpath.exists():
    for name,digest in read('data/artwork-checksums.json').items():
        assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
assert len(list(root.rglob('*.png')))==24
print('PASS: 20 species, 300 unique item entries, 24 PNGs, matching per-species data, valid baby references and artwork hashes.')
