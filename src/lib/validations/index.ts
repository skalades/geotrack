// src/lib/validations/index.ts — Zod Validation Schemas

import { z } from 'zod'

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email tidak valid'),
})

// ---- Users ----
export const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[0-9]/, 'Password harus mengandung angka'),
  role: z.enum(['super_admin', 'surveyor', 'client']),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['super_admin', 'surveyor', 'client']).optional(),
  isActive: z.boolean().optional(),
})

// ---- Target Points ----
export const createTargetPointSchema = z.object({
  pointCode: z
    .string()
    .min(3, 'Kode titik minimal 3 karakter')
    .regex(/^(GCP|ICP)-\d{3}$/, 'Format: GCP-001 atau ICP-001'),
  pointType: z.enum(['GCP', 'ICP']),
  targetLat: z.number().min(-90).max(90).optional().nullable(),
  targetLng: z.number().min(-180).max(180).optional().nullable(),
  description: z.string().optional().nullable(),
})

// ---- Assignment ----
export const assignPointSchema = z.object({
  surveyorId: z.string().min(1, 'Surveyor wajib dipilih'),
  scheduledDate: z.string().optional().nullable(),
})

// ---- Measurement Form ----
export const measurementFormSchema = z.object({
  pointCode: z.string().min(1, 'Kode titik wajib dipilih'),
  antennaHeight: z
    .number({ invalid_type_error: 'Tinggi antena harus angka' })
    .min(0.001, 'Tinggi antena minimal 0.001 m')
    .max(9.999, 'Tinggi antena maksimal 9.999 m'),
  conditionSekitar: z.enum(['terbuka', 'tajuk_ringan', 'tajuk_rapat'], {
    errorMap: () => ({ message: 'Pilih kondisi sekitar' }),
  }),
  weather: z.enum(['cerah', 'berawan', 'hujan'], {
    errorMap: () => ({ message: 'Pilih kondisi cuaca' }),
  }),
  receiverType: z.string().optional().nullable(),
  startTime: z.string().min(1, 'Waktu mulai wajib diisi'),
  endTime: z.string().min(1, 'Waktu selesai wajib diisi'),
  fieldNotes: z.string().max(1000).optional().nullable(),
})

// ---- Approve / Retake ----
export const approveSchema = z.object({
  pmNotes: z.string().max(1000).optional().nullable(),
})

export const retakeSchema = z.object({
  reason: z.string().min(10, 'Alasan retake minimal 10 karakter').max(500),
})

// ---- Filters ----
export const measurementFilterSchema = z.object({
  status: z.enum(['unassigned', 'progress', 'review', 'approved', 'retake']).optional(),
  surveyorId: z.coerce.number().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  pointType: z.enum(['GCP', 'ICP']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreateTargetPointInput = z.infer<typeof createTargetPointSchema>
export type AssignPointInput = z.infer<typeof assignPointSchema>
export type MeasurementFormInput = z.infer<typeof measurementFormSchema>
export type ApproveInput = z.infer<typeof approveSchema>
export type RetakeInput = z.infer<typeof retakeSchema>
export type MeasurementFilterInput = z.infer<typeof measurementFilterSchema>
