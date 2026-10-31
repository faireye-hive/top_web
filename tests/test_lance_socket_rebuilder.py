"""Regression tests for the source LAB dummy -> GLB rebuild."""
import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/'scripts/rebuild_lance_glb_sockets.py'
spec=importlib.util.spec_from_file_location('rebuild_lance_glb_sockets',PATH)
rebuilder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(rebuilder)


class RebuildTests(unittest.TestCase):
    def test_lab_matrices_are_present(self):
        d=rebuilder.parse_dummies()
        self.assertEqual(d[6]['parent'],18)
        self.assertEqual(d[9]['parent'],26)
        self.assertEqual(d[21]['parent'],4)
        self.assertEqual(d[22]['parent'],4)
        self.assertNotEqual(d[21]['matrix'],d[22]['matrix'])

    def test_matrix_multiplication_in_directx_order(self):
        d=rebuilder.parse_dummies()
        eye=[1.0 if row==col else 0.0
             for row in range(4) for col in range(4)]
        for ident in (6,9,21,22):
            self.assertEqual(rebuilder.matmul(d[ident]['matrix'],eye),d[ident]['matrix'])

    def test_rebuild_keeps_binary_and_animations(self):
        eye=[1.0 if r==c else 0.0 for r in range(4) for c in range(4)]
        binary=struct.pack('<'+16*56*'f',*(eye*56))
        nodes=[{'name':'Root','children':list(range(1,57))}]
        nodes.extend({'name':f'Bone {i}'} for i in range(56))
        for part in range(7):
            nodes.append({'name':f'Parte {part} · 01010021.lgo',
                          'mesh':part,'skin':0})
        gltf={'asset':{'version':'2.0'},'nodes':nodes,
              'skins':[{'joints':list(range(1,57)),'inverseBindMatrices':0}],
              'accessors':[{'type':'MAT4','componentType':5126,'count':56,'bufferView':0}],
              'bufferViews':[{'byteOffset':0,'byteLength':len(binary)}],
              'buffers':[{'byteLength':len(binary)}],
              'animations':[{'name':f'{x:03d} · Teste'} for x in (163,166,167,168,169)]}
        d=rebuilder.parse_dummies()
        rebuilder.add_socket_nodes(gltf,binary,d)
        rebuilder.mark_weapon_parts(gltf)
        added={n.get('extras',{}).get('topDummy'):n for n in gltf['nodes'] if
               'topDummy' in n.get('extras',{})}
        self.assertEqual(added[22]['matrix'],d[22]['matrix'])
        self.assertIn(gltf['nodes'].index(added[22]),gltf['nodes'][5]['children'])
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'test.glb'
            rebuilder.save_glb(path,gltf,binary)
            restored,buffer=rebuilder.load_glb(path)
            self.assertEqual(binary,buffer)
            self.assertEqual(len(restored['animations']),5)
            self.assertEqual({n.get('extras',{}).get('equipmentSlot') for n in
              restored['nodes'] if n.get('extras',{}).get('topRole')=='weapon'},
              {6,9})


if __name__=='__main__':
    unittest.main()
