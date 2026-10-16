# HOLD: broken0.1.7 declaration artifact

Do not adopt this tarball. It is preserved from source954f900cc1c5e250574b34ffe26b1dccbebef528 / published43142561c1b94f8d33d6db45a4a88a047929bd9a, SHA256 `53497d94c3f2b9ee0945f7d3398d621151702db17f5d9e2ffa37b7b915ba3614`.

Independent review found `ConversationInputErrorResponse` referenced by the generated function declaration but never declared/imported/exported. The earlier focused fixture used skipLibCheck and failed to detect the new declaration defect. Archive/public-runtime checks alone did not qualify that declaration. The corrected successor adds an explicit alias of the existing canonical public error type and checks the declaration/consumer without skipLibCheck. Earlier outcomes remain historical evidence, not acceptance of this archive.
