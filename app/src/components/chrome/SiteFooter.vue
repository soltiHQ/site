<script setup lang="ts">
import SoltiWordmark from '@/components/brand/SoltiWordmark.vue'
</script>

<template>
  <footer class="site-footer">
    <div class="o-container site-footer__inner">
      <SoltiWordmark inverse />
      <span class="site-footer__descriptor">site / UI foundation</span>
      <nav class="site-footer__links" aria-label="Footer navigation">
        <a href="#main-content">Top ↑</a>
        <a href="https://github.com/soltiHQ" target="_blank" rel="noreferrer">Source ↗</a>
      </nav>
    </div>
  </footer>
</template>
