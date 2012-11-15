class CreateRewinds < ActiveRecord::Migration
  def up
    create_table :rewinds do |t|
      t.datetime :timestamp
      t.string :action
    end
  end

  def down
    drop_table :rewinds
  end
end