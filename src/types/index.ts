// src/types/index.ts — Global Type Definitions for GeoTrack

export type UserRole = 'super_admin' | 'surveyor' | 'client'
export type PointType = 'GCP' | 'ICP'
export type MeasurementStatus = 'unassigned' | 'progress' | 'review' | 'approved' | 'retake'
export type NotificationType = 'assigned' | 'submitted' | 'approved' | 'retake' | 'milestone' | 'system'
export type WeatherCondition = 'cerah' | 'berawan' | 'hujan'
export type ConditionSekitar = 'terbuka' | 'tajuk_ringan' | 'tajuk_rapat'
export type PhotoDirection = 'north' | 'south' | 'east' | 'west'

// ---- Auth ----
export interface AuthUser {
  id: number
  name: string
  email: string
  role: UserRole
  isActive: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface JWTPayload {
  userId: string
  role: UserRole
  email: string
}

// ---- Users ----
export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  isActive: boolean
  lastLogin?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateUserDTO {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateUserDTO {
  name?: string
  email?: string
  role?: UserRole
  isActive?: boolean
}

// ---- Target Points ----
export interface TargetPoint {
  id: number
  pointCode: string
  pointType: PointType
  targetLat?: number | null
  targetLng?: number | null
  description?: string | null
  createdAt: string
  measurement?: Measurement | null
}

export interface CreateTargetPointDTO {
  pointCode: string
  pointType: PointType
  targetLat?: number
  targetLng?: number
  description?: string
}

// ---- Measurements ----
export interface ExifData {
  lat?: number | null
  lng?: number | null
  timestamp?: string | null
}

export interface PhotoSlot {
  url?: string | null
  exifLat?: number | null
  exifLng?: number | null
  exifTs?: string | null
}

export interface Measurement {
  id: number
  pointCode: string
  surveyorId: number
  status: MeasurementStatus
  antennaHeight?: number | null
  conditionSekitar?: ConditionSekitar | null
  weather?: WeatherCondition | null
  receiverType?: string | null
  startTime?: string | null
  endTime?: string | null
  scheduledDate?: string | null
  photoNorth: PhotoSlot
  photoSouth: PhotoSlot
  photoEast: PhotoSlot
  photoWest: PhotoSlot
  rinexFileUrl?: string | null
  fieldNotes?: string | null
  pmNotes?: string | null
  retakeCount: number
  assignedAt?: string | null
  createdAt: string
  updatedAt: string
  // relations
  surveyor?: Pick<User, 'id' | 'name' | 'email'>
  targetPoint?: TargetPoint
  retakeHistories?: RetakeHistory[]
}

export interface SubmitMeasurementDTO {
  pointCode: string
  antennaHeight: number
  conditionSekitar: ConditionSekitar
  weather: WeatherCondition
  receiverType?: string
  startTime: string
  endTime: string
  fieldNotes?: string
}

export interface AssignPointDTO {
  surveyorId: number
  scheduledDate?: string
}

export interface ApproveDTO {
  pmNotes?: string
}

export interface RetakeDTO {
  reason: string
}

// ---- Retake History ----
export interface RetakeHistory {
  id: number
  measurementId: number
  retakeNumber: number
  reason: string
  pmId: number
  oldPhotoNorthUrl?: string | null
  oldPhotoSouthUrl?: string | null
  oldPhotoEastUrl?: string | null
  oldPhotoWestUrl?: string | null
  oldRinexFileUrl?: string | null
  createdAt: string
}

// ---- Notifications ----
export interface Notification {
  id: number
  userId: number
  type: NotificationType
  message: string
  pointCode?: string | null
  isRead: boolean
  metadata?: Record<string, unknown> | null
  createdAt: string
}

// ---- Dashboard ----
export interface DashboardSummary {
  total: number
  unassigned: number
  progress: number
  review: number
  approved: number
  retake: number
  progressPercent: number
}

export interface DailyProgress {
  date: string
  approved: number
  submitted: number
}

export interface SurveyorStats {
  surveyorId: number
  surveyorName: string
  total: number
  approved: number
  retake: number
  progress: number
}

// ---- Activity Log ----
export interface ActivityLog {
  id: number
  userId: number
  action: string
  entityType: string
  entityId?: number | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ipAddress?: string | null
  notes?: string | null
  createdAt: string
  user?: Pick<User, 'id' | 'name' | 'role'>
}

// ---- API Response ----
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ---- Upload ----
export interface UploadResult {
  url: string
  filename: string
  size: number
  exif?: ExifData
}

// ---- Filters ----
export interface MeasurementFilters {
  status?: MeasurementStatus
  surveyorId?: number
  dateFrom?: string
  dateTo?: string
  pointType?: PointType
  search?: string
  page?: number
  limit?: number
}
