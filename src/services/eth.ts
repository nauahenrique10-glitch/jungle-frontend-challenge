const scale = 10n ** 18n
/** ETH decimal strings become integer wei. Never route monetary values through Number. */
export function toWei(value: string): bigint {
 if (!/^\d+(\.\d{1,18})?$/.test(value)) throw new Error('Valor ETH inválido.')
 const [integer, fraction = ''] = value.split('.')
 return BigInt(integer) * scale + BigInt(fraction.padEnd(18, '0'))
}
export function fromWei(value: bigint): string {
 if (value < 0n) throw new Error('Valor ETH negativo.')
 const fraction = (value % scale).toString().padStart(18, '0').replace(/0+$/, '').padEnd(2, '0')
 return `${value / scale}.${fraction}`
}
