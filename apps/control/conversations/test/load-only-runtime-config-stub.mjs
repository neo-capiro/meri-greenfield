// Worker/native-client only need the local fault constructor for this read-only fixture.
export const fault=code=>Object.assign(Error(code),{code});
