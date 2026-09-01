import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

export const Route = createFileRoute('/api/zapi-enviar-pdf')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Require an authenticated Supabase session — endpoint sends
          // PDFs via the company's Z-API account and must not be open.
          const authHeader = request.headers.get('authorization') || ''
          if (!authHeader.startsWith('Bearer ')) {
            return Response.json({ erro: 'Unauthorized' }, { status: 401 })
          }
          const token = authHeader.slice('Bearer '.length).trim()
          const SUPABASE_URL = process.env.SUPABASE_URL
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return Response.json({ erro: 'Auth not configured' }, { status: 500 })
          }
          const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
          const { data: userData, error: userErr } = await sb.auth.getUser(token)
          if (userErr || !userData?.user) {
            return Response.json({ erro: 'Unauthorized' }, { status: 401 })
          }

          const body = (await request.json()) as {
            telefone?: string
            nomeCliente?: string
            valor?: string | number
            pdfBase64?: string
            fileName?: string
            caption?: string
          }

          const telefone = (body.telefone || '5581995975549').replace(/\D/g, '')
          const nomeCliente = body.nomeCliente || 'Cliente'
          const valor = body.valor ?? ''
          const pdfBase64 = body.pdfBase64
          const fileName = body.fileName || `Documento_${nomeCliente}.pdf`
          const caption =
            body.caption ||
            `Olá! Segue o PDF para ${nomeCliente}${valor ? `, no valor de R$ ${valor}` : ''}.`

          if (!pdfBase64) {
            return Response.json(
              { erro: 'pdfBase64 é obrigatório' },
              { status: 400 },
            )
          }

          const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID
          const TOKEN = process.env.ZAPI_TOKEN
          const SECURITY_TOKEN = process.env.ZAPI_SECURITY_TOKEN

          if (!INSTANCE_ID || !TOKEN || !SECURITY_TOKEN) {
            return Response.json(
              { erro: 'Credenciais Z-API não configuradas' },
              { status: 400 },
            )
          }

          const documentPayload = pdfBase64.startsWith('data:')
            ? pdfBase64
            : `data:application/pdf;base64,${pdfBase64}`

          const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-document/pdf`

          const resposta = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': SECURITY_TOKEN,
            },
            body: JSON.stringify({
              phone: telefone,
              document: documentPayload,
              fileName,
              caption,
            }),
          })

          const json = await resposta.json().catch(() => ({}))
          if (!resposta.ok) {
            return Response.json(
              { erro: 'Z-API retornou erro', detalhe: json },
              { status: resposta.status },
            )
          }
          return Response.json(json)
        } catch (erro) {
          console.error('zapi-enviar-pdf error', erro)
          return Response.json(
            { erro: 'Erro ao enviar PDF' },
            { status: 500 },
          )
        }
      },
    },
  },
})
