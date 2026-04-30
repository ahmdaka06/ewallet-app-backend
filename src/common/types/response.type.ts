export type SuccessResponse<T> = {
    status: true;
    message: string;
    data: T;
};