export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  institution_id: string | null;
  student_id: string | null;
  region: string | null;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size?: number;
};

export type Finding = {
  id: string;
  institution: string;
  academic_year: string;
  type: string;
  source: string;
  severity: string;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
  model_score: number | null;
  review_state: string;
  resolution: string | null;
  created_at: string;
};
