
import api from "./api";

export type DeploymentStatus =
  | "PRE_DEPLOYMENT"
  | "DEPLOYED"
  | "COMPLETED"
  | "CANCELLED";

export interface DeploymentChecklistItem {
  document_type: string;
  label: string;
  required: boolean;
  document_id: string | null;
  status: string;
}

export interface DeploymentChecklist {
  items: DeploymentChecklistItem[];
  ready_for_deployment: boolean;
}

export interface InternshipDeployment {
  id: string;
  application_id: string;
  student_id: string;
  company_id: string;
  academic_year: string;
  semester: string;
  status: DeploymentStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  deployment_date: string | null;
  created_at: string;
  company_name?: string | null;
  checklist?: DeploymentChecklist | null;
}

function normalizeDeployment(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const checklist = record.checklist;
  if (checklist != null) {
    if (typeof checklist !== "object") throw new Error("Invalid deployment checklist");
    const data = checklist as Record<string, unknown>;
    if (!Array.isArray(data.items) || typeof data.ready_for_deployment !== "boolean") {
      throw new Error("Invalid deployment checklist");
    }
    for (const item of data.items) {
      if (!item || typeof item !== "object" ||
          typeof item.document_type !== "string" || typeof item.label !== "string" ||
          typeof item.required !== "boolean" || typeof item.status !== "string" ||
          (item.document_id !== null && typeof item.document_id !== "string")) {
        throw new Error("Invalid deployment checklist item");
      }
    }
  }
  return {
    ...record,
    status: typeof record.status === "string"
      ? record.status.toUpperCase()
      : record.status,
  };
}

function isDeployment(value: unknown): value is InternshipDeployment {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.company_id === "string" &&
    typeof record.status === "string" &&
    [
      "PRE_DEPLOYMENT",
      "DEPLOYED",
      "COMPLETED",
      "CANCELLED",
    ].includes(record.status)
  );
}

export const deploymentService = {
  async getMyDeployment(): Promise<InternshipDeployment | null> {
    const response = await api.get<unknown>("/deployments/my");

    if (response.status === 204 || response.data == null) {
      return null;
    }

    const payload = response.data;
    const unwrapped = typeof payload === "object" && "deployment" in payload
      ? (payload as Record<string, unknown>).deployment
      : payload;

    if (unwrapped == null) return null;

    const candidate = normalizeDeployment(unwrapped);

    if (!isDeployment(candidate)) {
      throw new Error("Unexpected deployment API response");
    }

    return candidate;
  },

  async getDeploymentById(
    deploymentId: string
  ): Promise<InternshipDeployment> {
    const response = await api.get<unknown>(
      `/deployments/${encodeURIComponent(deploymentId)}`
    );

    const deployment = normalizeDeployment(response.data);

    if (!isDeployment(deployment)) {
      throw new Error("Unexpected deployment detail response");
    }

    return deployment;
  },
};
