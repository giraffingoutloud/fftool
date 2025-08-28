import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import type { ConflictRecord } from '@/lib/improvedDeduplication';

interface DeduplicationReportProps {
  report: {
    adpConflicts: ConflictRecord[];
    projectionConflicts: ConflictRecord[];
    dataQualityScore: number;
    flaggedForReview: string[];
  };
  positionEligibility?: Map<string, string[]>;
}

export function DeduplicationReport({ 
  report, 
  positionEligibility 
}: DeduplicationReportProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle2 className="w-4 h-4" />;
    if (confidence >= 0.5) return <AlertCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const getQualityBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', variant: 'default' as const };
    if (score >= 75) return { label: 'Good', variant: 'secondary' as const };
    if (score >= 60) return { label: 'Fair', variant: 'outline' as const };
    return { label: 'Poor', variant: 'destructive' as const };
  };

  const qualityBadge = getQualityBadge(report.dataQualityScore);

  return (
    <div className="space-y-6">
      {/* Data Quality Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Data Quality Report
            <Badge variant={qualityBadge.variant}>
              {qualityBadge.label} - {report.dataQualityScore.toFixed(0)}%
            </Badge>
          </CardTitle>
          <CardDescription>
            Overall data integrity and deduplication confidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Conflicts</p>
                <p className="text-2xl font-bold">
                  {report.adpConflicts.length + report.projectionConflicts.length}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Need Review</p>
                <p className="text-2xl font-bold">{report.flaggedForReview.length}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Auto-Resolved</p>
                <p className="text-2xl font-bold">
                  {report.adpConflicts.filter(c => c.confidence >= 0.7).length +
                   report.projectionConflicts.filter(c => c.confidence >= 0.7).length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ADP Conflicts */}
      {report.adpConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              ADP Conflicts ({report.adpConflicts.length})
            </CardTitle>
            <CardDescription>
              Conflicting Average Draft Position values resolved using median
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full">
              <div className="space-y-3">
                {report.adpConflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{conflict.playerKey}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          Values: {conflict.values.map(v => 
                            v !== null && v !== undefined ? v.toFixed(1) : 'N/A'
                          ).join(', ')}
                        </span>
                        <span className="text-sm font-medium">
                          → {conflict.resolution?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${getConfidenceColor(conflict.confidence)}`}>
                      {getConfidenceIcon(conflict.confidence)}
                      <span className="text-sm font-medium">
                        {(conflict.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Projection Conflicts */}
      {report.projectionConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Projection Conflicts ({report.projectionConflicts.length})
            </CardTitle>
            <CardDescription>
              Conflicting fantasy point projections resolved using weighted average
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full">
              <div className="space-y-3">
                {report.projectionConflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{conflict.playerKey}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          Values: {conflict.values.map(v => 
                            v !== null && v !== undefined ? v.toFixed(1) : 'N/A'
                          ).join(', ')}
                        </span>
                        <span className="text-sm font-medium">
                          → {conflict.resolution?.toFixed(1) || 'N/A'} pts
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${getConfidenceColor(conflict.confidence)}`}>
                      {getConfidenceIcon(conflict.confidence)}
                      <span className="text-sm font-medium">
                        {(conflict.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Players Flagged for Review */}
      {report.flaggedForReview.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Manual Review Required</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-2">
              {report.flaggedForReview.length} players have low-confidence resolutions and should be manually reviewed:
            </p>
            <div className="flex flex-wrap gap-2">
              {report.flaggedForReview.slice(0, 10).map(playerId => (
                <Badge key={playerId} variant="outline">
                  {playerId}
                </Badge>
              ))}
              {report.flaggedForReview.length > 10 && (
                <Badge variant="outline">
                  +{report.flaggedForReview.length - 10} more
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Position Eligibility */}
      {positionEligibility && positionEligibility.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Multi-Position Eligible Players</CardTitle>
            <CardDescription>
              Players eligible at multiple positions for lineup flexibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] w-full">
              <div className="space-y-2">
                {Array.from(positionEligibility.entries())
                  .filter(([_, positions]) => positions.length > 1)
                  .slice(0, 20)
                  .map(([playerId, positions]) => (
                    <div key={playerId} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{playerId}</span>
                      <div className="flex gap-1">
                        {positions.map(pos => (
                          <Badge key={pos} variant="secondary">
                            {pos}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DeduplicationReport;