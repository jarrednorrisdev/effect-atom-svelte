<!-- A tuple whose last element follows its rest: the fourth input's constraints change as the row grows. -->
<script lang="ts">
  import { Schema } from "effect";

  import { Form, useForm } from "../../src/index.ts";

  const Row = Form.make(
    Schema.Struct({
      row: Schema.TupleWithRest(
        Schema.Tuple([Schema.String.check(Schema.isMaxLength(1))]),
        [
          Schema.String.check(Schema.isMaxLength(2)),
          Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(10)),
        ]
      ),
    })
  );
  const id = $props.id();
  const form = useForm(Row, {
    id,
    initialValues: { row: ["", "", "", ""] },
  });
  const fourth = form.field(["row", 3]);
</script>

<label for={fourth.id}>Fourth</label>
<input {...fourth.attrs} {...fourth.constraints} bind:value={fourth.value} />
<button onclick={() => form.setValues(({ row }) => ({ row: [...row, ""] }))}>
  Add
</button>
