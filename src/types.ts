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

export type ValueSet = {
  controllingField?: string | null | undefined;
  restricted?: boolean | null | undefined;
  valueSetDefinition?: ValueSetValuesDefinition | null | undefined;
  valueSetName?: string | null | undefined;
  valueSettings: ValueSettings[];
};

export type ValueSetValuesDefinition = {
  sorted: boolean;
  value: CustomValue[];
};

export type CustomValue = {
  fullName?: string | null | undefined;
  color?: string | null | undefined;
  default: boolean;
  description?: string | null | undefined;
  isActive?: boolean | null | undefined;
  label?: string | null | undefined;
  valueName?: string;
};

export type ValueSettings = {
  controllingFieldValue: string[];
  valueName: string;
};

export interface CustomField {
  fullName: string;
  label?: string;
  type?: string;
  defaultValue?: string;
  valueSet?: ValueSet;
  restricted?: boolean;
  valueSetName?: string;
  values?: string;
}
