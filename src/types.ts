import { MetadataInfo } from 'jsforce';

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

export interface CustomValue {
  valueName: string;
  label: string;
  default?: boolean;
}

interface ValueSet {
  restricted?: boolean;
  valueSetName?: string;
  valueSetDefinition?: {
    sorted?: boolean;
    value: CustomValue[];
  };
}

export interface CustomField extends MetadataInfo {
  label?: string;
  type?: string;
  defaultValue?: string;
  valueSet?: ValueSet;
  restricted?: boolean;
  valueSetName?: string;
  values?: string;
}
