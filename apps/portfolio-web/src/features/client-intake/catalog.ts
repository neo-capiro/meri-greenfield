// Boundary vocabulary verified against capirov2 @capiro/shared and
// ClientsService funding-profile validation. Values, including punctuation,
// are persisted identifiers; labels are presentation only.
export const certifications = [
  "8A",
  "SDVOSB",
  "VOSB",
  "WOSB",
  "EDWOSB",
  "HUBZONE",
] as const;
export const organizationTypes = [
  ["Small businesses", "Small business"],
  [
    "For profit organizations other than small businesses",
    "Other for-profit organization",
  ],
  [
    "Nonprofits having a 501(c)(3) status with the IRS, other than institutions of higher education",
    "Nonprofit with 501(c)(3) status",
  ],
  [
    "Nonprofits that do not have a 501(c)(3) status with the IRS, other than institutions of higher education",
    "Nonprofit without 501(c)(3) status",
  ],
  [
    "Public and State controlled institutions of higher education",
    "Public college or university",
  ],
  ["Private institutions of higher education", "Private college or university"],
  ["Independent school districts", "Independent school district"],
  ["State governments", "State government"],
  ["County governments", "County government"],
  ["City or township governments", "City or township government"],
  ["Special district governments", "Special district government"],
  [
    "Public housing authorities/Indian housing authorities",
    "Public or Indian housing authority",
  ],
  [
    "Native American tribal governments (Federally recognized)",
    "Federally recognized tribal government",
  ],
  [
    "Native American tribal organizations (other than Federally recognized tribal governments)",
    "Other tribal organization",
  ],
  ["Individuals", "Individual"],
] as const;
export { sectors } from "@/shared/domain/sector";
export const tracks = [
  ["NDAA", "NDAA Authorization Request"],
  ["APPROPRIATIONS", "Appropriations Plus-Up"],
  ["CDS", "CDS / Earmark Request"],
  ["AUTHORIZATION", "Authorization (non-NDAA)"],
  ["FARM_BILL", "Farm Bill Provision"],
  ["ADVOCACY", "Advocacy / Dear Colleague"],
] as const;
export const businessFlags = [
  ["sb", "Small Business (SB)"],
  ["wosb", "WOSB"],
  ["sdvosb", "SDVOSB"],
  ["hubzone", "HUBZone"],
  ["eightA", "8(a)"],
  ["large", "Large Business"],
  ["foreignOwned", "Foreign-owned"],
] as const;
export const samStatuses = [
  "Active",
  "Expired",
  "Not registered",
  "Pending",
] as const;
