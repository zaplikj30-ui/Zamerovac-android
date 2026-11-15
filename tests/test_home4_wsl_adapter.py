"""Real filesystem/transport predicates, synthetic channel; NOT WSL runtime proof."""
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/qa'))
from home4_contract import Blocked,sha,audit_source
import home4_wsl as bridge


class WslAdapterModels(unittest.TestCase):
    def test_mapped_paths_are_explicit_and_reject_unknown_drive_or_traversal(self):
        self.assertEqual(bridge.mapped('C:\\qa\\file',{'C:\\':'/mnt/c'}),Path('/mnt/c/qa/file'))
        for p in ['D:\\qa','C:\\qa\\..\\secret','relative','\\\\server\\share\\file']:
            with self.assertRaises(Blocked):bridge.mapped(p,{'C:\\':'/mnt/c'})

    def test_fresh_manifest_copy_preserves_bytes_and_neighbour_and_rejects_reuse(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);source=base/'source';source.mkdir();(source/'sentinel').write_bytes(bytes([0,255,42]))
            files={'sentinel':sha(bytes([0,255,42]))};target=base/'private'
            bridge.copy_manifest(source,target,files,3)
            self.assertEqual((target/'sentinel').read_bytes(),(source/'sentinel').read_bytes())
            with self.assertRaises(FileExistsError):bridge.copy_manifest(source,target,files,3)
            audit_source(target,files)
            build=target/'app/build';build.mkdir(parents=True);(build/'output').write_bytes(b'generated');audit_source(target,files)
            (target/'extra').write_bytes(b'unknown')
            with self.assertRaises(Blocked):audit_source(target,files)
            with self.assertRaises(Blocked):bridge.closed_tree(target,files)
            self.assertEqual((source/'sentinel').read_bytes(),bytes([0,255,42]))

    def test_copy_over_budget_and_changed_source_block_without_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);source=base/'source';source.mkdir();(source/'data').write_bytes(b'original')
            files={'data':sha(b'original')}
            with self.assertRaises(Blocked):bridge.copy_manifest(source,base/'one',files,1)
            (source/'data').write_bytes(b'changed')
            with self.assertRaises(Blocked):bridge.copy_manifest(source,base/'two',files,100)
            self.assertEqual((source/'data').read_bytes(),b'changed')

    def channel(self,chunks):
        # No stdin/process access: pipe fragmentation is supplied by the model.
        chunks=list(chunks)
        with patch.object(bridge.select,'select',side_effect=lambda *args:([sys.stdin],[],[]) if chunks else ([],[],[])),patch.object(bridge.os,'read',side_effect=lambda *args:chunks.pop(0)):
            bridge.check_channel('a'*32)

    def test_fragmented_LF_CRLF_heartbeats_allow_preparation(self):
        self.channel([b'AL',b'IVE '+b'a'*32+b'\r',b'\n'])
        self.channel([(b'ALIVE '+b'a'*32+b'\n')*2])

    def test_cancel_EOF_wrong_token_and_partial_channel_block_before_launch(self):
        for chunks in [[b''],[b'CANCEL '+b'a'*32+b'\n'],[b'ALIVE '+b'b'*32+b'\n'],[b'ALIVE']]:
            with self.assertRaises(Blocked):self.channel(chunks)


if __name__=='__main__':unittest.main()
