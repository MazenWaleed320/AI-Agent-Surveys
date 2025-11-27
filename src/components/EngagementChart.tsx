import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type EngagementChartProps = {
  surveyId: string;
};

const EngagementChart = ({ surveyId }: EngagementChartProps) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEngagementData();
  }, [surveyId]);

  const fetchEngagementData = async () => {
    setLoading(true);
    try {
      const { data: responses, error } = await supabase
        .from("survey_responses")
        .select("response_score, created_at")
        .eq("survey_id", surveyId)
        .not("response_score", "is", null)
        .order("created_at");

      if (error) throw error;

      // Group by day and calculate average
      const groupedData = responses?.reduce((acc: any, curr: any) => {
        const date = new Date(curr.created_at).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = { scores: [], date };
        }
        acc[date].scores.push(curr.response_score);
        return acc;
      }, {});

      const chartData = Object.values(groupedData || {}).map((item: any) => ({
        date: item.date,
        score: (item.scores.reduce((a: number, b: number) => a + b, 0) / item.scores.length / 5 * 100).toFixed(0)
      }));

      setData(chartData);
    } catch (error) {
      console.error("Error fetching engagement data:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle>Engagement Trends</CardTitle>
        <CardDescription>Average scores over time</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available yet
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  name="Engagement Score (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EngagementChart;
