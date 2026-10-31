"""Checks for complete historical pose selection and GLB export verification."""
import ast
import json
import shutil
import stat
import struct
import tempfile
import unittest
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, is_zipfile
import importlib.util

ROOT = Path(__file__).resolve().parents[1]


def load_build_helpers():
    src = ROOT / 'scripts/build_evanescence.py'
    module = ast.parse(src.read_text())
    nodes = [x for x in module.body if isinstance(x, ast.FunctionDef) and
             x.name in ('selected_action_ids', 'prepare_client_source')]
    scope = {'Path': Path, 'PurePosixPath': PurePosixPath, 'ZipFile': ZipFile,
             'is_zipfile': is_zipfile, 'stat': stat, 'shutil': shutil}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(src), 'exec'), scope)
    return scope


def load_verifier():
    path = ROOT / 'scripts/verify_pose_glb.py'
    spec = importlib.util.spec_from_file_location('pose_verify', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PoseExportTest(unittest.TestCase):
    def test_complete_and_compact_selection(self):
        select = load_build_helpers()['selected_action_ids']
        complete = select(3)
        self.assertEqual(len(complete), 108)
        self.assertEqual(complete, sorted(set(complete)))
        for code in (1, 16, 30, 31, 54, 163, 166, 168, 169, 170,
                     171, 178, 192, 193, 216):
            self.assertIn(code, complete)
        compact = select(3, compact=True)
        self.assertEqual(len(compact), 17)
        self.assertIn(16, compact)
        self.assertIn(166, compact)
        self.assertNotIn(192, compact)

    def test_zip_source_and_traversal(self):
        prepare = load_build_helpers()['prepare_client_source']
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            zippath = work / 'assets.zip'
            with ZipFile(zippath, 'w') as archive:
                archive.writestr('Client/scripts/table/characterinfo.txt', 'test')
                archive.writestr('Client/animation/0000.lab', b'abc')
                archive.writestr('manifesto.txt', 'no effect')
            dest = prepare(zippath, work / 'extract')
            self.assertEqual((dest / 'animation/0000.lab').read_bytes(), b'abc')
            self.assertEqual(dest, work / 'extract/Client')
            with ZipFile(zippath, 'w') as archive:
                archive.writestr('Client/../../unwanted', 'bad')
            with self.assertRaisesRegex(ValueError, 'inseguro'):
                prepare(zippath, work / 'malicious')

    def test_all_available_lance_dual_frames_are_expected(self):
        verify = load_verifier()
        expected = verify.historical_ids('lance', 3)
        self.assertEqual(len(expected), 72)
        self.assertIn(166, expected)
        self.assertIn(192, expected)
        self.assertIn(30, expected)
        self.assertNotIn(175, expected)  # no source frames for Lance

    def test_glb_animation_names_and_invalid_header(self):
        verify = load_verifier()
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'test.glb'
            payload = json.dumps({'animations': [{'name': '016 · Sentado no chão'},
                                                   {'name': '166 · Guarda'}]}).encode()
            payload += b' ' * (-len(payload) % 4)
            target.write_bytes(b'glTF' + struct.pack('<II', 2, 20 + len(payload)) +
                               struct.pack('<I4s', len(payload), b'JSON') + payload)
            self.assertEqual(verify.read_glb_animations(target),
                             ['016 · Sentado no chão', '166 · Guarda'])
            target.write_bytes(b'bad')
            with self.assertRaisesRegex(ValueError, 'incompleto'):
                verify.read_glb_animations(target)


if __name__ == '__main__':
    unittest.main()
