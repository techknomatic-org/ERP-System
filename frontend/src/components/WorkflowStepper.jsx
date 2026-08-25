import React from 'react';
import { CheckCircle2, Clock, Circle } from 'lucide-react';

const DEFAULT_STAGES = ['Site Engineer', 'Project Manager', 'Finance', 'Management'];

export default function WorkflowStepper({ currentStage = 'Site Engineer', status = 'pending', stages = DEFAULT_STAGES }) {
  const isRejected = status === 'rejected';

  return (
    <div className="workflow-tracker">
      {stages.map((stageName, index) => {
        let isDone = false;
        let isCurrent = false;

        const currentStageIndex = stages.findIndex(s => s.toLowerCase() === currentStage.toLowerCase());
        const stageIndex = index;

        if (status === 'approved' || status === 'verified_matched') {
          isDone = true;
        } else if (stageIndex < currentStageIndex) {
          isDone = true;
        } else if (stageIndex === currentStageIndex) {
          isCurrent = true;
        }

        return (
          <React.Fragment key={stageName}>
            <div className={`workflow-step ${isDone ? 'completed' : isCurrent ? (isRejected ? 'tag-danger' : 'current') : 'pending'}`}>
              {isDone ? (
                <CheckCircle2 size={13} color="#34d399" />
              ) : isCurrent ? (
                <Clock size={13} className="spin-animation" style={{ animationDuration: '3s' }} />
              ) : (
                <Circle size={13} color="#64748b" />
              )}
              <span>{stageName}</span>
            </div>
            {index < stages.length - 1 && (
              <div style={{ width: '16px', height: '2px', background: isDone ? '#34d399' : 'rgba(255,255,255,0.1)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
