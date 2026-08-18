export type Gender = "Pria" | "Wanita" | "Lainnya";

export type Participant = {
  id: string;
  name: string;
  gender: Gender;
  pos_x: number;
  pos_y: number;
  submitted_at: string;
};

export const GENDER_OPTIONS: Gender[] = ["Pria", "Wanita", "Lainnya"];

export const SCRATCH_OBJECTS = [
  {
    id: "hat",
    label: "Graduation Hat",
    colorSrc: "/assets/hat-color.png",
    maskSrc: "/assets/hat-white.png",
  },
  {
    id: "pencil",
    label: "Pencil",
    colorSrc: "/assets/pencil-color.png",
    maskSrc: "/assets/pencil-white.png",
  },
  {
    id: "ribbon",
    label: "Ribbon",
    colorSrc: "/assets/ribbon-color.png",
    maskSrc: "/assets/ribbon-white.png",
  },
] as const;

export type ScratchId = (typeof SCRATCH_OBJECTS)[number]["id"];

export const SESSION_KEYS = {
  name: "gsa_name",
  gender: "gsa_gender",
  scratches: "gsa_scratches_v3",
  submitted: "gsa_submitted",
  clientId: "gsa_client_id",
  reportedScratches: "gsa_reported_scratches_v1",
} as const;
