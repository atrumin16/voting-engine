// functions/api/proposals.js
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const proposalsStmt = env.DB.prepare("SELECT * FROM proposals ORDER BY created_at DESC");
    const proposals = await proposalsStmt.all();

    const results = await Promise.all(proposals.results.map(async (proposal) => {
      const yesVotes = await env.DB.prepare(
        "SELECT SUM(vote_power) as total FROM votes WHERE proposal_id = ? AND choice = 'yes'"
      ).bind(proposal.id).first();

      const noVotes = await env.DB.prepare(
        "SELECT SUM(vote_power) as total FROM votes WHERE proposal_id = ? AND choice = 'no'"
      ).bind(proposal.id).first();

      const totalPower = (yesVotes.total || 0) + (noVotes.total || 0);
      
      return {
        ...proposal,
        yes_count: yesVotes.total || 0,
        no_count: noVotes.total || 0,
        total_power: totalPower,
        yes_percentage: totalPower > 0 ? ((yesVotes.total || 0) / totalPower) * 100 : 0
      };
    }));

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
