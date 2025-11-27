import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { responseId, responseText } = await req.json();
    console.log("Analyzing sentiment for response:", responseId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Call Lovable AI for sentiment analysis
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an HR sentiment analysis expert. Analyze employee feedback and provide:
1. Sentiment (positive/negative/neutral)
2. Confidence score (0.00 to 1.00)
3. Key themes (array of 2-5 key topics)
4. Brief summary of the feedback

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.85,
  "key_themes": ["work-life balance", "management"],
  "summary": "Brief summary of the feedback"
}`
          },
          {
            role: 'user',
            content: `Analyze this employee feedback: "${responseText}"`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    // Strip markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse the JSON response from AI
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      // Fallback to basic analysis
      analysis = {
        sentiment: content.toLowerCase().includes('negative') ? 'negative' : 
                   content.toLowerCase().includes('positive') ? 'positive' : 'neutral',
        confidence: 0.7,
        key_themes: ['general feedback'],
        summary: responseText.substring(0, 200)
      };
    }

    // Store sentiment analysis in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: sentimentData, error: sentimentError } = await supabase
      .from('sentiment_analysis')
      .insert({
        response_id: responseId,
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        key_themes: analysis.key_themes,
        ai_summary: analysis.summary,
      })
      .select()
      .single();

    if (sentimentError) {
      console.error("Error storing sentiment:", sentimentError);
      throw sentimentError;
    }

    // Check if we should flag this response (lowered threshold to catch more negative feedback)
    if (analysis.sentiment === 'negative' && analysis.confidence > 0.5) {
      console.log("Negative sentiment detected, creating flag...");
      
      // Get employee and survey info
      const { data: response, error: responseError } = await supabase
        .from('survey_responses')
        .select('employee_id, survey_id')
        .eq('id', responseId)
        .single();

      if (responseError) {
        console.error("Error fetching response data:", responseError);
      } else if (response) {
        console.log("Response data:", response);
        
        // Check if a flag already exists for this response to prevent duplicates
        const { data: existingFlags } = await supabase
          .from('response_flags')
          .select('id')
          .eq('employee_id', response.employee_id)
          .eq('survey_id', response.survey_id)
          .eq('issue_type', 'negative_sentiment')
          .eq('status', 'pending');
        
        if (existingFlags && existingFlags.length > 0) {
          console.log("Flag already exists for this response, skipping duplicate");
        } else {
          const { data: flagData, error: flagError } = await supabase
            .from('response_flags')
            .insert({
              employee_id: response.employee_id,
              survey_id: response.survey_id,
              severity: analysis.confidence > 0.8 ? 'critical' : 'warning',
              issue_type: 'negative_sentiment',
              description: `Negative feedback detected: ${analysis.summary}`,
              flagged_by: 'system',
              status: 'pending',
            })
            .select();
          
          if (flagError) {
            console.error("Error creating response flag:", flagError);
            console.error("Flag error details:", JSON.stringify(flagError));
          } else {
            console.log("Response flag created successfully:", flagData);
            
            // Notify all HR managers about negative feedback
            const { data: hrManagers } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', 'hr_manager');

            if (hrManagers && hrManagers.length > 0) {
              const notificationPromises = hrManagers.map((manager) =>
                supabase.from('notifications').insert({
                  recipient_id: manager.user_id,
                  title: 'Negative Feedback Alert',
                  message: `Negative feedback detected with ${Math.round(analysis.confidence * 100)}% confidence: ${analysis.summary.substring(0, 100)}`,
                  type: 'negative_feedback',
                  related_id: flagData?.[0]?.id,
                })
              );
              await Promise.all(notificationPromises);
              console.log('HR managers notified about negative feedback');
            }
          }
        }
      }
    } else {
      console.log(`No flag needed. Sentiment: ${analysis.sentiment}, Confidence: ${analysis.confidence}`);
    }

    console.log("Sentiment analysis completed:", sentimentData);

    return new Response(JSON.stringify({ 
      success: true, 
      analysis: sentimentData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-sentiment function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
