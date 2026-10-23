import type { AccountErrors, PasswordInput, ProfileInput, WalletInput } from '@/types/account'
import { avatarMaxBytes, avatarTypes } from '@/types/account'

const emailValid = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const usernameValid = (value: string) => /^[a-zA-Z0-9_-]{3,24}$/.test(value)
const ensValid = (value: string) => !value || /^(?:[a-z0-9-]+\.)+eth$/i.test(value) && value.length <= 255
const addressValid = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value)
export function validateProfile(input: ProfileInput): AccountErrors {
 const errors: AccountErrors = {}
 if (input.displayName.trim().length < 2 || input.displayName.trim().length > 80) errors.displayName = 'Use de 2 a 80 caracteres.'
 if (!usernameValid(input.username.trim())) errors.username = 'Use de 3 a 24 letras, números, _ ou -.'
 if (!emailValid(input.email.trim())) errors.email = 'Informe um e-mail válido.'
 if (!ensValid(input.ens?.trim() ?? '')) errors.ens = 'Informe um nome .eth válido ou deixe vazio.'
 if ((input.walletNickname?.trim().length ?? 0) > 60) errors.walletNickname = 'Use até 60 caracteres.'
 return errors
}
export function validatePassword(input: PasswordInput): AccountErrors {
 const errors: AccountErrors = {}
 if (!input.currentPassword || input.currentPassword.length > 128) errors.currentPassword = 'Informe a senha atual (até 128 caracteres).'
 if (input.newPassword.length < 8 || input.newPassword.length > 128) errors.newPassword = 'Use uma senha de 8 a 128 caracteres.'
 else if (input.newPassword === input.currentPassword) errors.newPassword = 'Escolha uma senha diferente da atual.'
 if (!input.confirmPassword || input.confirmPassword !== input.newPassword) errors.confirmPassword = 'As senhas devem ser iguais.'
 return errors
}
export function validateWallet(input: WalletInput): AccountErrors {
 const errors: AccountErrors = {}
 if (input.displayName.trim().length < 2 || input.displayName.trim().length > 80) errors.displayName = 'Use de 2 a 80 caracteres.'
 if (!input.label.trim() || input.label.trim().length > 60) errors.label = 'Informe um apelido de até 60 caracteres.'
 if (!['Ethereum', 'Polygon'].includes(input.network)) errors.network = 'Selecione uma rede disponível.'
 if (!usernameValid(input.username.trim())) errors.username = 'Use de 3 a 24 letras, números, _ ou -.'
 if (!addressValid(input.address.trim())) errors.address = 'Informe o endereço completo: 0x e 40 caracteres hexadecimais.'
 if (input.secondaryAddress.trim() && !addressValid(input.secondaryAddress.trim()) && !ensValid(input.secondaryAddress.trim())) errors.secondaryAddress = 'Informe um endereço 0x completo ou nome .eth.'
 if (!['WalletConnect', 'MetaMask', 'Coinbase Wallet'].includes(input.provider)) errors.provider = 'Selecione um tipo de carteira.'
 if (input.referralCode.length > 64 || input.referralCode && !/^[a-zA-Z0-9_-]+$/.test(input.referralCode)) errors.referralCode = 'Use até 64 letras, números, _ ou -.'
 if (!emailValid(input.email.trim())) errors.email = 'Informe um e-mail válido.'
 if (!ensValid(input.ens.trim())) errors.ens = 'Informe um nome .eth válido ou deixe vazio.'
 if (!['primary', 'secondary'].includes(input.role)) errors.role = 'Tipo de prioridade inválido.'
 return errors
}
export function validateAvatar(file: File): string | null {
 if (!avatarTypes.includes(file.type as typeof avatarTypes[number])) return 'Use uma imagem PNG, JPEG ou WebP.'
 if (!file.size || file.size > avatarMaxBytes) return 'A imagem deve ter até 512 KB e não pode estar vazia.'
 return null
}
