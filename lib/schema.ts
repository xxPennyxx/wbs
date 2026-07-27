/**
 * ============================================================================
 *  SCHEMA MAP  —  the ONE place to adjust if column names differ in the DB.
 * ============================================================================
 *  Each logical field lists candidate column names; the row mapper picks the
 *  first that exists (case-insensitive). Real column names (verified against
 *  the ZapsightFAview database) are listed first.
 *
 *  Diagnostics: http://localhost:3000/api/schema
 */

// --- Table / view names -----------------------------------------------------
export const TABLES = {
  wbs: "Projectworkbreakdownstructure",
  projects: "Projectmaster",
};

// --- Projects list columns  (source: dbo.Projectmaster) ---------------------
export const PROJECT_COLUMNS = {
  id: ["PROJECTID", "ProjectId", "Project ID"],
  name: ["PROJECTNAME", "ProjectName", "Project name"],
  group: ["PROJECTGROUP", "ProjectGroup", "Project group"],
  legalEntity: ["COMPANYCODE", "LegalEntity", "Legal entity", "DataAreaId"],
  contractId: ["PROJECTCONTRACTID", "ProjectContractId", "Project contract ID"],
  type: ["PROJECTTYPE", "ProjectType", "Project type"],
  fpelStage: ["PROJECTSTAGE", "FPELProjectStage", "FPEL Project stage"],
  stage: ["STATUS", "WBSSTAGE", "ProjectStage", "Project stage"],
  region: ["REGION", "Region"],
  siteName: ["SITENAME", "Site name"],
  capacityAc: ["PLANT_CAPACITYAC", "CapacityAC"],
  capacityDc: ["PLANT_CAPACITYDC", "CapacityDC"],
  amCoordinator: ["AMCORODINATOR", "AMCoordinatorDescription", "AM Coordinator description"],
  channelPartner: ["CHANNELPARTNER", "ChannelPartner", "Channel Partner"],
  integrationSource: ["INTEGRATIONSOURCE", "IntegrationSource", "Integration source"],
};

// --- Work-breakdown-structure columns  (source: dbo.Projectworkbreakdownstructure)
export const WBS_COLUMNS = {
  projectId: ["PROJID", "ProjectId", "Project ID", "ProjectID"],
  // Only used for the WBS-derived fallback list (rarely, since Projectmaster exists).
  projectName: ["ProjectName", "Project name"],
  // Dotted WBS id. Hierarchy is normally derived from HIERARCHYID (see wbs.ts);
  // these are display/fallback candidates.
  // PATHID carries the nested sequence (1, 2, 2.1, 2.2, 3), so it is primary.
  wbsId: ["PATHID", "WBSTASKID", "WBS ID", "TASKSEQUENCE"],
  taskName: ["TASKNAME", "TaskName", "Task name"],
  predecessors: ["Predecessors", "Predecessor"],
  category: ["TASKCATEGORY", "Category"],
  projectBudgetCategory: ["ProjectBudgetCategory", "Project budget category"],
  effortHours: ["TASKASSIGNEDHOURS", "EffortInHours", "Effort in hours"],
  startDate: ["TASKPLANNEDSTARTDATE", "Actualstartdate", "TaskStartDate", "Task start date"],
  endDate: ["TASKPLANNEDFINISHDATE", "Actualenddate", "TaskEndDate", "Task end date"],
  duration: ["TASKDURATION", "Actualduration", "Duration"],
  numResources: ["NUMBEROFRESOURCES", "NumberOfResources"],
  roleId: ["RoleId", "Role ID"],
  resources: ["Resources", "Resource"],
  staffingStatus: ["StaffingStatus", "Staffing status"],
  unstaffed: ["Unstaffed"],
  trackerType: ["TrackerType", "Tracker type"],
  priority: ["TASKPRIORITY", "Priority"],
  budgetedQty: ["Budgetedqty", "BudgetedQty", "Budgeted qty"],
  completedQty: ["Completedqty", "CompletedQty", "Completed qty"],
  weightage: ["WeightagePercentage", "Weightage", "Weightage %"],
  progress: ["taskprogresspercentage", "TotalProgress", "Total % of progress"],
};

/** Case-insensitive lookup: return the value of the first matching column. */
export function pick(row: Record<string, any>, candidates: string[]): any {
  const lowerMap: Record<string, string> = {};
  for (const key of Object.keys(row)) lowerMap[key.toLowerCase()] = key;
  for (const cand of candidates) {
    const hit = lowerMap[cand.toLowerCase()];
    if (hit !== undefined) return row[hit];
  }
  return null;
}

/** Given a column-config object, map a raw DB row into a clean object. */
export function mapRow<T extends Record<string, string[]>>(
  row: Record<string, any>,
  cols: T
): { [K in keyof T]: any } {
  const out = {} as { [K in keyof T]: any };
  for (const key of Object.keys(cols) as (keyof T)[]) {
    out[key] = pick(row, cols[key]);
  }
  return out;
}
