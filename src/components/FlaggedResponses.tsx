import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type FlaggedResponsesProps = {
  surveyId: string;
};

const FlaggedResponses = ({ surveyId }: FlaggedResponsesProps) => {
  const navigate = useNavigate();
  const [flaggedItems, setFlaggedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlaggedResponses();

    // Subscribe to realtime changes for new/updated flags
    const channel = supabase
      .channel(`response_flags_survey_${surveyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'response_flags', filter: `survey_id=eq.${surveyId}` },
        () => fetchFlaggedResponses()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [surveyId]);

  const fetchFlaggedResponses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("response_flags")
        .select(`
          *,
          profiles!response_flags_employee_id_fkey (full_name, department)
        `)
        .eq("survey_id", surveyId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const items = (data as any[]) || [];
      const uniqueMap = new Map<string, any>();
      for (const it of items) {
        const desc = (it.description || "").replace(/```[\s\S]*?```/g, "").trim();
        const key = `${it.employee_id ?? "none"}-${it.survey_id ?? "none"}-${it.issue_type ?? "issue"}-${desc}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, { ...it, description: desc });
      }
      setFlaggedItems(Array.from(uniqueMap.values()));
    } catch (error) {
      console.error("Error fetching flagged responses:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Flagged Responses
            </CardTitle>
            <CardDescription>Items requiring HR attention</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : flaggedItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No flagged responses</p>
        ) : (
          <div className="space-y-4">
            {flaggedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate("/analytics")}
                className="flex items-start gap-4 rounded-lg border p-4 transition-all hover:bg-muted/50 cursor-pointer"
              >
                <div className="flex-shrink-0 mt-1">
                  {item.severity === "critical" ? (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{item.profiles?.full_name || "Anonymous"}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.profiles?.department || "Unknown"}
                    </Badge>
                  </div>
                  <p className="text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FlaggedResponses;
