import ctypes, json
from ctypes import wintypes
class Memory(ctypes.Structure):
    _fields_ = [('length',wintypes.DWORD),('load',wintypes.DWORD)] + [(name,ctypes.c_ulonglong) for name in ('physicalTotal','physicalAvailable','commitTotal','commitAvailable','virtualTotal','virtualAvailable','extended')]
value=Memory(); value.length=ctypes.sizeof(value)
if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(value)):
    raise ctypes.WinError()
print(json.dumps({name:getattr(value,name) for name in ('physicalTotal','physicalAvailable','commitTotal','commitAvailable')}))
