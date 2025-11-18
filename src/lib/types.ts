export interface AuthCredentials {
  msisdn?: string;
  password?: string;
  otp?: string;
  puk?: string;
  channel?: string;
}

export interface LineContext {
  alias?: string;
  contractId?: string;
  lineId?: string;
  billingAccountId?: string;
}

export interface ApiResponse<T=unknown> {
  data: T;
  error?: string;
  status: number;
}