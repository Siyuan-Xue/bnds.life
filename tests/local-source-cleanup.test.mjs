import test from "node:test";
import { execFileSync } from "node:child_process";
test("local source cleanup requires fresh verified playback and preserves other inputs", () => {
  execFileSync(
    "python3",
    [
      "-c",
      `
import importlib.util, tempfile, pathlib, hashlib, datetime
spec=importlib.util.spec_from_file_location('cleanup', 'scripts/cleanup-local-sources.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 p=pathlib.Path(d);(p/'ok.mov').write_bytes(b'camera');(p/'keep.mov').write_bytes(b'other!')
 (p/'link.mov').symlink_to(p/'ok.mov')
 r={'policy':'metadata-only-originals','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verified':[{'id':'one','status':'published','size':6,'sha256':hashlib.sha256(b'camera').hexdigest()}]}
 assert m.cleanup(d,r)['bytes']==6 and (p/'ok.mov').exists()
 assert m.cleanup(d,r,True)['bytes']==6 and not (p/'ok.mov').exists()
 assert (p/'keep.mov').exists() and (p/'link.mov').is_symlink()
 r['verifiedAt']='2000-01-01T00:00:00+00:00'
 try:m.cleanup(d,r,True)
 except ValueError:pass
 else:raise AssertionError('stale receipt accepted')
`,
    ],
    { stdio: "pipe" },
  );
});
