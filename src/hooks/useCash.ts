import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { TransferForm } from '../types'

export function useCashTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (form: TransferForm) => {
      const { from_register_id, to_register_id, amount, description } = form

      // Insert transfer_out movement
      const { error: outError } = await supabase.from('cash_movements').insert({
        cash_register_id: from_register_id,
        type: 'transfer_out',
        amount,
        reference_type: 'transfer',
        description: description || `Transferencia a caja`,
      })
      if (outError) throw outError

      // Insert transfer_in movement
      const { error: inError } = await supabase.from('cash_movements').insert({
        cash_register_id: to_register_id,
        type: 'transfer_in',
        amount,
        reference_type: 'transfer',
        description: description || `Transferencia desde caja`,
      })
      if (inError) throw inError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] })
      queryClient.invalidateQueries({ queryKey: ['cash_movements'] })
    },
  })
}

export function useAddCashMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      cash_register_id: string
      type: 'income' | 'expense'
      amount: number
      description: string
      user_id: string
    }) => {
      const { error } = await supabase.from('cash_movements').insert({
        ...data,
        reference_type: 'manual',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] })
      queryClient.invalidateQueries({ queryKey: ['cash_movements'] })
    },
  })
}
