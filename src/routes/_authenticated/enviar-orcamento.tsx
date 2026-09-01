import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/enviar-orcamento')({
  component: EnviarOrcamento,
})

function EnviarOrcamento() {
  const [nomeCliente, setNomeCliente] = useState('')
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    if (!nomeCliente || !valor) {
      toast.error('Preencha todos os campos!')
      return
    }
    setEnviando(true)
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.')
        setEnviando(false)
        return
      }
      const res = await fetch('/api/zapi-enviar-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ nomeCliente, valor }),
      })
      const dado = await res.json()
      if (dado.id || dado.messageId || dado.zaapId) {
        toast.success('✅ Enviado para WhatsApp!')
        setNomeCliente('')
        setValor('')
      } else {
        toast.error('❌ Erro: ' + (dado.error || dado.erro || 'tente novamente'))
      }
    } catch {
      toast.error('❌ Falha de conexão')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>📄 Enviar Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Cliente</Label>
            <Input
              id="nome"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor">Valor R$</Label>
            <Input
              id="valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex: 2.450,00"
            />
          </div>
          <Button onClick={enviar} disabled={enviando} className="w-full">
            {enviando ? 'Enviando...' : '📤 Enviar para WhatsApp'}
          </Button>
          <div className="text-xs text-muted-foreground space-y-1 pt-2">
            <p>✅ Sistema salvo e sempre disponível</p>
            <p>❌ NÃO SALVA PDF NEM DADOS EM LUGAR NENHUM</p>
            <p>✅ Envio direto via WhatsApp (Z-API)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
