import { defineComponent, onMounted, type PropType } from "vue";
import { inject, type AnalyticsOptions, type BeforeSend } from "./index";

export { track, type AnalyticsOptions, type BeforeSend } from "./index";

/** Counts page views from the root component (App.vue, or app.vue in Nuxt). Renders nothing. */
export const Analytics = defineComponent({
  name: "OrbitsAnalytics",
  props: {
    mode: String as PropType<AnalyticsOptions["mode"]>,
    debug: { type: Boolean, default: undefined },
    beforeSend: Function as PropType<BeforeSend>,
    scriptSrc: String,
    endpoint: String,
  },
  setup(props) {
    onMounted(() => inject({ ...props }));
    return () => null;
  },
});
