/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FileUploadResponseDto } from '../models/FileUploadResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FilesService {
    /**
     * Upload files
     * @param type
     * @param formData
     * @returns FileUploadResponseDto File uploaded successfully
     * @throws ApiError
     */
    public static fileUploadControllerUploadFiles(
        type: string,
        formData: {
            files?: Blob;
        },
    ): CancelablePromise<FileUploadResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/files/upload/{type}',
            path: {
                'type': type,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                400: `Invalid file`,
            },
        });
    }
}
