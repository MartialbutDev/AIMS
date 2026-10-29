// Compatibility exports; all requests use the admin-only API.
export { getEligibleCoordinatorFaculty, getCoordinatorDesignations as getDeanCoordinatorDesignations, createCoordinatorDesignation as createDeanCoordinatorDesignation, deactivateCoordinatorDesignation as deactivateDeanCoordinatorDesignation } from './coordinatorDesignationService'
export type { EligibleCoordinatorFaculty, CoordinatorDesignation as DeanCoordinatorDesignation, CreateCoordinatorDesignation as CreateDeanCoordinatorDesignation, DesignationResult, DeactivateDesignationResult } from './coordinatorDesignationService'
