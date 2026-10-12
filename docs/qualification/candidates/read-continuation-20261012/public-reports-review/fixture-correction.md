# Preserved first-replay fixture correction

The committed26 initial controls produced24PASS/2FAIL at exact author d86c071.
Both failures were the reviewer's non-midnight date fixture in GAO/CRS, not a
source defect. Independent Prisma annotation inspection confirms publishDate
and date are nullable @db.Date, serialized to UTC midnight; CBO pubDate is
@db.Timestamptz. Replaced only the positive stored-date value with midnight and
added the former timestamp as an explicit negative. Original tests and raw
failure are retained in a1b0cad/d7def6e. Five additional controls cover signed Int,
clipped label whitespace, unique keys/order and metadata limits. No production
source changed.
