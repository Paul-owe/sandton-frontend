export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'

export interface Patient {
  id?: string | number
  active?: boolean
  fileNumber?: string
  name?: string
  surname?: string
  fullName?: string
  gender?: Gender | ''
  dateOfBirth?: string
  idNumber?: string
  address?: string
  contact?: string
  emailAddress?: string
  profession?: string
  religionChurch?: string
  nextOfKinName?: string
  nextOfKinRelationship?: string
  nextOfKinContact?: string
  dateOfAdmission?: string
  branchId?: string | number
  branchName?: string
  allowFrontDeskDetailsEditOnce?: boolean
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

export type CreatePatientPayload = Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
