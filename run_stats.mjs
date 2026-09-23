import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gehpoyxsqvjfwhzuulby.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM';
const admin = createClient(supabaseUrl, supabaseServiceKey);

async function runStats() {
    // 1. Get all profiles
    const { data: profiles } = await admin.from('profiles').select('*');
    console.log("Profiles:");
    profiles.forEach(p => console.log(`- ${p.full_name} (${p.id})`));

    // 2. Count calls grouped by operator_id
    const { data: logs, error } = await admin.from('call_logs').select('operator_id, status');
    if (error) {
        console.error(error);
        return;
    }

    const stats = {};
    logs.forEach(log => {
        const opId = log.operator_id || 'System/Unknown';
        if (!stats[opId]) stats[opId] = { total: 0, answered: 0, missed: 0 };
        stats[opId].total++;
        if (log.status === 'answered' || log.status === 'completed') stats[opId].answered++;
        else stats[opId].missed++;
    });

    console.log("\nCall Stats:");
    for (const opId of Object.keys(stats)) {
        const profile = profiles.find(p => p.id === opId);
        const name = profile ? profile.full_name : opId;
        console.log(`${name}: ${stats[opId].total} calls (${stats[opId].answered} answered, ${stats[opId].missed} missed/other)`);
    }
}
runStats();
