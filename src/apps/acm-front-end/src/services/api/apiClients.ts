// Custom error class for API errors
export class ApiError extends Error {
  public status: number;
  public data?: any;

  constructor(
    status: number,
    message: string,
    data?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Response type wrapper
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

// Error response type
export interface ErrorResponse {
  message?: string;
  [key: string]: any;
}