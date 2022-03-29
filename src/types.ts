export type LayoutAssignment = {
  layout: string;
  recordType?: string;
};

export type LayoutAssignmentsPerProfile = {
  [profile: string]: LayoutAssignment[];
};

export type ProfileMetadata = {
  fullName: string;
  layoutAssignments: LayoutAssignment[];
};
