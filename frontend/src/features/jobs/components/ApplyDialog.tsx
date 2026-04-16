'use client'

import { toast } from 'sonner'
import { CheckCircle, Bookmark } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useApplyJob } from '../hooks/useApplyJob'
import type { Job } from '@/types/jobs'

interface ApplyDialogProps {
  job: Job | null
  open: boolean
  onClose: () => void
}

export function ApplyDialog({ job, open, onClose }: ApplyDialogProps) {
  const { mutate, isPending } = useApplyJob()

  const handleApplied = () => {
    if (!job) return
    mutate(
      { jobId: job.id, status: 'applied' },
      {
        onSuccess: () => {
          toast.success('Application marked as applied!')
          onClose()
        },
        onError: () => {
          toast.error('Failed to record application. Try again.')
        },
      }
    )
  }

  const handleSaved = () => {
    if (!job) return
    mutate(
      { jobId: job.id, status: 'saved' },
      {
        onSuccess: () => {
          toast.success('Job saved for later!')
          onClose()
        },
        onError: () => {
          toast.error('Failed to save job. Try again.')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Application opened in a new tab</DialogTitle>
          <DialogDescription>
            {job?.company} &middot; {job?.title}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-foreground">Did you complete the application?</p>

        <DialogFooter className="border-0 bg-transparent px-0 pb-0 sm:flex-col gap-2">
          <Button className="w-full gap-2" onClick={handleApplied} disabled={isPending}>
            <CheckCircle className="size-4" />
            {isPending ? 'Saving...' : 'Mark as Applied'}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleSaved}
            disabled={isPending}
          >
            <Bookmark className="size-4" />
            {isPending ? 'Saving...' : 'Save for later'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
