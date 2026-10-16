"""Run only the approved expected-failure type stage, preserving its real no-skip compiler result."""
import pathlib,runpy
root=pathlib.Path(__file__).resolve().parent
source=(root/'input-tooling.py').read_text(encoding='utf-8')
source=source.replace("OUT=ROOT/'input-tooling'","OUT=ROOT/'input-types-before'").replace("ROOT/'input-tooling-profile.json'","ROOT/'input-types-before-profile.json'")
source=source.replace("!=26:raise RuntimeError('Expected exactly26 existing artifacts before generation')","!=30:raise RuntimeError('Expected exactly30 existing artifacts before negative type check')")
exec(compile(source,str(root/'input-tooling.py'),'exec'),{'__file__':str(root/'input-tooling.py'),'__name__':'__main__'})
