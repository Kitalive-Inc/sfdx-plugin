import { JsonMap } from '@salesforce/ts-types';

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
  restricted?: boolean | string | null | undefined;
  valueSetDefinition?: ValueSetValuesDefinition | null | undefined;
  valueSetName?: string | null | undefined;
  valueSettings?: ValueSettings[];
};

export type ValueSetValuesDefinition = {
  sorted?: boolean;
  value: CustomValue[];
};

export type CustomValue = {
  fullName?: string | null | undefined;
  color?: string | null | undefined;
  default?: boolean;
  description?: string | null | undefined;
  isActive?: boolean | null | undefined;
  label?: string | null | undefined;
  valueName?: string;
};

export type ValueSettings = {
  controllingFieldValue: string[];
  valueName: string;
};

export type CustomField = JsonMap & {
  fullName: string;
  label?: string | null | undefined;
  type?: string | null | undefined;
  defaultValue?: string | null | undefined;
  deleteConstraint?: 'SetNull' | 'Restrict' | 'Cascade';
  displayFormat?: string | null | undefined;
  displayLocationInDecimal?: boolean | null | undefined;
  formula?: string | null | undefined;
  formulaTreatBlanksAs?: string | null | undefined;
  lookupFilter?: LookupFilter;
  relationshipLabel?: string | null | undefined;
  reparentableMasterDetail?: boolean | null | undefined;
  restricted?: boolean | string | null | undefined;
  summaryFilterItems?: FilterItem[];
  valueSet?: ValueSet;
  valueSetName?: string | null | undefined;
  values?: string | null | undefined;
  writeRequiresMasterRead?: boolean | null | undefined;
};

export type FilterItem = {
  field: string;
  operation: string;
  value?: string;
  valueField?: string;
};

export type LookupFilter = {
  active: boolean;
  booleanFilter?: string;
  description?: string;
  errorMessage?: string;
  filterItems: FilterItem[];
  infoMessage?: string;
  isOptional: boolean;
};
