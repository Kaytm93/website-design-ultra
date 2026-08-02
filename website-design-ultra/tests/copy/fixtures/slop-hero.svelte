<script>
  // Here's the thing. This comment sits in the component script and is not
  // copy. If script stripping regresses, en:throat-clearing fires here.
  let open = false
  const variant = 'seamless'
</script>

<section class="hero seamless-grid">
  <h1>Unlock the full potential of your workflow</h1>
  <p>It's not just a note-taker. It's your team's second brain.</p>
  <p>
    Experts agree that a robust and intuitive platform is what teams who care
    about craft need.
  </p>
  <button on:click={() => (open = true)}>Get started</button>
</section>

<style>
  /* Most teams get this wrong: styles are not copy either. If style stripping
     regresses, en:faux-insight fires here. */
  .hero { display: grid; }
</style>
