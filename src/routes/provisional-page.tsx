import { Link } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
export function ProvisionalPage({ title, description }: { title: string; description?: string }) {
 return <section className="provisional"><Construction aria-hidden="true"/><p className="eyebrow">Em desenvolvimento · Etapa 1</p><h1>{title}</h1><p>{description ?? 'Esta tela ainda não foi implementada. Nenhuma operação ou alteração de dados está disponível nesta etapa.'}</p><Button asChild><Link to="/">Voltar ao início</Link></Button></section>
}
