import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

type DepartmentBreakdownProps = {
  surveyId: string;
};

const DepartmentBreakdown = ({ surveyId }: DepartmentBreakdownProps) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartmentData();
  }, [surveyId]);

  const fetchDepartmentData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("survey_responses")
        .select(`
          response_score,
          employee_id,
          profiles!inner (department)
        `)
        .eq("survey_id", surveyId)
        .not("response_score", "is", null);

      if (error) throw error;

      // Group by department
      const deptMap = new Map<string, { scores: number[]; count: number }>();
      data?.forEach((row: any) => {
        const dept = row.profiles?.department || "Unknown";
        if (!deptMap.has(dept)) {
          deptMap.set(dept, { scores: [], count: 0 });
        }
        const entry = deptMap.get(dept)!;
        entry.scores.push(row.response_score);
        entry.count++;
      });

      const deptData = Array.from(deptMap.entries()).map(([name, data]) => {
        const avgScore = Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length / 5) * 100);
        return {
          name,
          score: avgScore,
          responses: data.count,
          sentiment: avgScore >= 70 ? ("success" as const) : avgScore >= 50 ? ("warning" as const) : ("destructive" as const)
        };
      });

      setDepartments(deptData);
    } catch (error) {
      console.error("Error fetching department data:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Department Breakdown</CardTitle>
        <CardDescription>Engagement scores by department</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : departments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No data available yet</p>
        ) : (
          departments.map((dept) => (
            <div key={dept.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{dept.name}</span>
                  <Badge variant={dept.sentiment} className="text-xs">
                    {dept.score}%
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {dept.responses} responses
                </span>
              </div>
              <Progress value={dept.score} className="h-2" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default DepartmentBreakdown;
