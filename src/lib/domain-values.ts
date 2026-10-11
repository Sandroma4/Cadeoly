export const Visibility = {
  PRIVATE: "PRIVATE",
  FAMILY: "FAMILY",
  LINK: "LINK",
  PUBLIC: "PUBLIC",
} as const;
export type Visibility = (typeof Visibility)[keyof typeof Visibility];

export const Priority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  ESSENTIAL: "ESSENTIAL",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const FamilyRole = { ADMIN: "ADMIN", MEMBER: "MEMBER" } as const;
export type FamilyRole = (typeof FamilyRole)[keyof typeof FamilyRole];
