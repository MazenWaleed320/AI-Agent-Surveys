import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

type DepartmentNegativeStats = {
  department: string;
  negative_count: number;
};

type NegativeFeedbackByDepartmentProps = {
  surveyId: string;
};

const NegativeFeedbackByDepartment = ({ surveyId }: NegativeFeedbackByDepartmentProps) => {
  const [departmentStats, setDepartmentStats] = useState<DepartmentNegativeStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNegativeFeedback();
  }, [surveyId]);

  const fetchNegativeFeedback = async () => {
    setLoading(true);
    try {
      // Fetch all flagged responses with department info
      const { data, error } = await supabase
        .from("response_flags")
        .select(`
          id,
          profiles!response_flags_employee_id_fkey (department)
        `)
        .eq("survey_id", surveyId)
        .eq("status", "pending");

      if (error) throw error;

      // Group by department and count
      const deptMap = new Map<string, number>();
      data?.forEach((flag: any) => {
        const dept = flag.profiles?.department || "Unknown";
        deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
      });

      // Convert to array and sort by count
      const stats = Array.from(deptMap.entries())
        .map(([department, negative_count]) => ({ department, negative_count }))
        .sort((a, b) => b.negative_count - a.negative_count);

      setDepartmentStats(stats);
    } catch (error) {
      console.error("Error fetching negative feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxCount = Math.max(...departmentStats.map(d => d.negative_count), 1);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Negative Feedback by Department
        </CardTitle>
        <CardDescription>Departments with the most negative review submissions</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : departmentStats.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No negative feedback yet</p>
        ) : (
          <div className="space-y-4">
            {departmentStats.map((dept) => (
              <div key={dept.department} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{dept.department}</span>
                  <span className="text-sm font-semibold text-destructive">
                    {dept.negative_count} {dept.negative_count === 1 ? 'issue' : 'issues'}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-warning to-destructive transition-all duration-500"
                    style={{ width: `${(dept.negative_count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NegativeFeedbackByDepartment;
