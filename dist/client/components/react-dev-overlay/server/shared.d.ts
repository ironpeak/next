/// <reference types="node" />
import type { StackFrame } from 'stacktrace-parser';
import type { ServerResponse } from 'http';
export type SourcePackage = 'react' | 'next';
export interface OriginalStackFrameResponse {
    originalStackFrame?: StackFrame | null;
    originalCodeFrame?: string | null;
    /** We use this to group frames in the error overlay */
    sourcePackage?: SourcePackage | null;
}
/** Given a frame, it parses which package it belongs to. */
export declare function findSourcePackage({ file, methodName, }: Partial<{
    file: string | null;
    methodName: string | null;
}>): SourcePackage | undefined;
/**
 * It looks up the code frame of the traced source.
 * @note It ignores node_modules or Next.js/React internals, as these can often be huge budnled files.
 */
export declare function getOriginalCodeFrame(frame: StackFrame, source: string | null): string | null | undefined;
export declare function noContent(res: ServerResponse): void;
export declare function badRequest(res: ServerResponse): void;
export declare function internalServerError(res: ServerResponse, e?: any): void;
export declare function json(res: ServerResponse, data: any): void;
